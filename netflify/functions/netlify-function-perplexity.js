// netlify/functions/perplexity-treatment.js
const axios = require('axios');

exports.handler = async function(event, context) {
  // Sprawdzenie czy metoda to POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
      headers: {
        'Allow': 'POST',
        'Content-Type': 'application/json'
      }
    };
  }

  try {
    // Parsowanie danych wejściowych
    const requestData = JSON.parse(event.body);
    const { diagnosis, medicalSociety } = requestData;

    // Sprawdzenie wymaganych pól
    if (!diagnosis || !medicalSociety) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Brakuje diagnozy lub towarzystwa medycznego do przygotowania rekomendacji leczenia' }),
        headers: { 'Content-Type': 'application/json' }
      };
    }

    // Klucz API z zmiennych środowiskowych Netlify
    const apiKey = process.env.PERPLEXITY_API_KEY;
    
    if (!apiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Błąd konfiguracji API Perplexity' }),
        headers: { 'Content-Type': 'application/json' }
      };
    }

    // Przygotowanie promptu do Perplexity
    const prompt = `
      Działasz jako ekspert medyczny specjalizujący się w leczeniu chorób, opierający się na oficjalnych wytycznych medycznych.
      
      Wyszukaj aktualne, oficjalne rekomendacje leczenia dla następującej diagnozy: "${diagnosis}".
      Te rekomendacje powinny być zgodne z wytycznymi następującego towarzystwa naukowego: "${medicalSociety}".
      
      Twoja odpowiedź musi zawierać:
      1. Szczegółową farmakoterapię według oficjalnych wytycznych: nazwy leków, dawkowanie, czas leczenia
      2. Zalecenia niefarmakologiczne rekomendowane przez towarzystwo
      3. Oficjalne zalecenia dotyczące kontroli i dalszego postępowania
      4. Charakterystykę kluczowego leku zalecanego w terapii, bazując na OFICJALNEJ, RZĄDOWEJ charakterystyce produktu leczniczego (np. z URPL, EMA lub innego oficjalnego źródła):
         - Mechanizm działania
         - Wskazania rejestracyjne
         - Przeciwwskazania
         - Działania niepożądane (najważniejsze)
         - Interakcje z innymi lekami (najważniejsze)
      
      Zwróć odpowiedź w formacie JSON:
      {
        "Farmakoterapia": [lista leków i rekomendacji],
        "Zalecenia_Niefarmakologiczne": [lista zaleceń],
        "Kontrola_i_Monitorowanie": [zalecenia dotyczące dalszego postępowania],
        "Charakterystyka_Leku": {
          "Nazwa": "nazwa leku",
          "Mechanizm_Działania": "opis z oficjalnej charakterystyki produktu",
          "Wskazania": [lista wskazań z oficjalnego źródła],
          "Przeciwwskazania": [lista przeciwwskazań z oficjalnego źródła],
          "Działania_Niepożądane": [lista działań niepożądanych z oficjalnego źródła],
          "Interakcje": [lista interakcji z oficjalnego źródła]
        }
      }
      
      Odpowiedź musi być w języku polskim, oparta WYŁĄCZNIE na oficjalnych, aktualnych wytycznych medycznych i charakterystykach produktów leczniczych. Podaj tylko dane w formacie JSON, bez dodatkowych komentarzy.
    `;

    // Konfiguracja zapytania do API Perplexity
    const perplexityResponse = await axios.post(
      'https://api.perplexity.ai/chat/completions',
      {
        model: "llama-3-sonar-small-32k", // lub inny model Perplexity AI
        messages: [
          { role: "system", content: "Jesteś ekspertem w dziedzinie medycyny, specjalizującym się w leczeniu chorób na podstawie najnowszych wytycznych klinicznych." },
          { role: "user", content: prompt }
        ],
        temperature: 0.1, // Niska temperatura dla precyzyjnych odpowiedzi medycznych
        max_tokens: 2000
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // Parsowanie odpowiedzi od Perplexity
    const responseContent = perplexityResponse.data.choices[0].message.content;
    
    // Próba parsowania JSON z odpowiedzi
    let parsedResponse;
    try {
      // Szukanie JSON w odpowiedzi tekstowej - czasem API zwraca dodatkowy tekst przed/po JSON
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : responseContent;
      parsedResponse = JSON.parse(jsonString);
    } catch (e) {
      console.error("Błąd parsowania JSON z odpowiedzi Perplexity:", e);
      console.log("Otrzymana odpowiedź:", responseContent);
      
      // Jeśli nie udało się sparsować JSON, zwróć oryginalną odpowiedź jako tekst
      return {
        statusCode: 207, // Partial Content - sukces, ale nie idealny format
        body: JSON.stringify({ 
          error: "Odpowiedź nie jest poprawnym JSON. Pokazuję tekst oryginalny.", 
          rawResponse: responseContent 
        }),
        headers: { 'Content-Type': 'application/json' }
      };
    }

    // Sprawdzenie czy JSON zawiera wymagane pola
    const requiredFields = ['Farmakoterapia', 'Zalecenia_Niefarmakologiczne', 'Kontrola_i_Monitorowanie', 'Charakterystyka_Leku'];
    const missingFields = requiredFields.filter(field => !parsedResponse[field]);
    
    if (missingFields.length > 0) {
      return {
        statusCode: 207, // Partial Content
        body: JSON.stringify({ 
          warning: `Niekompletna odpowiedź, brakuje wymaganych pól: ${missingFields.join(', ')}`, 
          data: parsedResponse 
        }),
        headers: { 'Content-Type': 'application/json' }
      };
    }

    // Zwróć odpowiedź do klienta
    return {
      statusCode: 200,
      body: JSON.stringify(parsedResponse),
      headers: { 'Content-Type': 'application/json' }
    };

  } catch (error) {
    console.error("Błąd podczas komunikacji z API Perplexity:", error);
    
    let errorMessage = 'Wystąpił błąd podczas przetwarzania zapytania';
    let statusCode = 500;
    
    if (error.response) {
      // Błąd po stronie API Perplexity
      errorMessage = `Błąd API: ${error.response.status} - ${error.response.data.error?.message || JSON.stringify(error.response.data)}`;
      statusCode = error.response.status === 429 ? 429 : 502; // Rate limit lub inny błąd od API
    } else if (error.request) {
      // Brak odpowiedzi od API
      errorMessage = 'Brak odpowiedzi od serwera API';
      statusCode = 504; // Gateway Timeout
    }
    
    return {
      statusCode,
      body: JSON.stringify({ error: errorMessage }),
      headers: { 'Content-Type': 'application/json' }
    };
  }
};
