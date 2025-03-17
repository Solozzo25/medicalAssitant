// netlify/functions/perplexity-treatment.js
const axios = require('axios');

exports.handler = async function(event, context) {
  console.log("🔄 Funkcja perplexity-treatment została wywołana");
  
  // Sprawdzenie czy metoda to POST
  if (event.httpMethod !== 'POST') {
    console.log("❌ Błąd: Niewłaściwa metoda HTTP:", event.httpMethod);
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
    
    console.log("📋 Dane otrzymane:", { 
      diagnosis, 
      medicalSociety
    });

    // Sprawdzenie wymaganych pól
    if (!diagnosis || !medicalSociety) {
      console.log("❌ Błąd: Brakuje wymaganych pól");
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Brakuje diagnozy lub towarzystwa medycznego do przygotowania rekomendacji leczenia' }),
        headers: { 'Content-Type': 'application/json' }
      };
    }

    // Klucz API z zmiennych środowiskowych Netlify
    const apiKey = process.env.PERPLEXITY_API_KEY;
    
    if (!apiKey) {
      console.log("❌ Błąd: Brak klucza API Perplexity w zmiennych środowiskowych");
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Błąd konfiguracji API - brak klucza Perplexity' }),
        headers: { 'Content-Type': 'application/json' }
      };
    }
    
    console.log("🔑 Klucz API Perplexity znaleziony (pierwszych 5 znaków):", apiKey.substring(0, 5) + '...');

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

    console.log("📤 Wysyłanie zapytania do Perplexity API...");
    console.log("📝 Prompt - diagnoza:", diagnosis);
    console.log("📝 Prompt - towarzystwo medyczne:", medicalSociety);
    
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
    
    console.log("✅ Odpowiedź od Perplexity otrzymana, status:", perplexityResponse.status);
    if (perplexityResponse.data.usage) {
      console.log("📊 Użycie tokenów:", {
        prompt_tokens: perplexityResponse.data.usage.prompt_tokens,
        completion_tokens: perplexityResponse.data.usage.completion_tokens,
        total_tokens: perplexityResponse.data.usage.total_tokens
      });
    }

    // Parsowanie odpowiedzi od Perplexity
    const responseContent = perplexityResponse.data.choices[0].message.content;
    console.log("📝 Surowa odpowiedź od Perplexity (pierwsze 300 znaków):", responseContent.substring(0, 300) + '...');
    
    // Próba parsowania JSON z odpowiedzi
    let parsedResponse;
    try {
      // Szukanie JSON w odpowiedzi tekstowej - czasem API zwraca dodatkowy tekst przed/po JSON
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : responseContent;
      console.log("🔍 Próba parsowania JSON...");
      parsedResponse = JSON.parse(jsonString);
      console.log("✅ Pomyślnie sparsowano JSON z odpowiedzi");
    } catch (e) {
      console.error("❌ Błąd parsowania JSON z odpowiedzi Perplexity:", e);
      console.log("📝 Próbowany JSON:", jsonMatch ? jsonMatch[0].substring(0, 100) + '...' : 'Nie znaleziono');
      
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
    const requiredFields = ['Farmakoterapia', 'Zalecenia_Niefarmakologiczne', 'Charakterystyka_Leku'];
    const missingFields = requiredFields.filter(field => !parsedResponse[field]);
    
    if (missingFields.length > 0) {
      console.log("⚠️ Niekompletna odpowiedź JSON, brakujące pola:", missingFields);
      return {
        statusCode: 207, // Partial Content
        body: JSON.stringify({ 
          warning: `Niekompletna odpowiedź, brakuje wymaganych pól: ${missingFields.join(', ')}`, 
          data: parsedResponse 
        }),
        headers: { 'Content-Type': 'application/json' }
      };
    }
    
    // Sprawdzenie czy charakterystyka leku zawiera wszystkie wymagane pola
    const drugFields = ['Nazwa', 'Wskazania', 'Przeciwwskazania', 'Interakcje'];
    const missingDrugFields = drugFields.filter(field => !parsedResponse.Charakterystyka_Leku[field]);
    
    if (missingDrugFields.length > 0) {
      console.log("⚠️ Niekompletna charakterystyka leku, brakujące pola:", missingDrugFields);
      return {
        statusCode: 207, // Partial Content
        body: JSON.stringify({ 
          warning: `Niekompletna charakterystyka leku, brakuje pól: ${missingDrugFields.join(', ')}`, 
          data: parsedResponse 
        }),
        headers: { 'Content-Type': 'application/json' }
      };
    }
    
    console.log("✅ Wszystkie wymagane pola są obecne, zwracanie odpowiedzi");
    console.log("📋 Lek główny:", parsedResponse.Charakterystyka_Leku.Nazwa); 
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
    console.error("❌ Błąd podczas komunikacji z API Perplexity:", error);
    
    let errorMessage = 'Wystąpił błąd podczas przetwarzania zapytania';
    let statusCode = 500;
    let errorDetails = {};
    
    if (error.response) {
      // Błąd po stronie API Perplexity
      console.error("❌ Odpowiedź z błędem od API:", {
        status: error.response.status,
        data: error.response.data
      });
      
      errorMessage = `Błąd API: ${error.response.status} - ${error.response.data.error?.message || JSON.stringify(error.response.data)}`;
      statusCode = error.response.status === 429 ? 429 : 502; // Rate limit lub inny błąd od API
      errorDetails = {
        status: error.response.status,
        message: error.response.data.error?.message,
        type: error.response.data.error?.type
      };
    } else if (error.request) {
      // Brak odpowiedzi od API
      console.error("❌ Brak odpowiedzi od serwera API Perplexity");
      errorMessage = 'Brak odpowiedzi od serwera API';
      statusCode = 504; // Gateway Timeout
    } else {
      // Inny błąd
      console.error("❌ Nieoczekiwany błąd:", error.message);
      errorDetails = { message: error.message };
    }
    
    return {
      statusCode,
      body: JSON.stringify({ 
        error: errorMessage,
        details: errorDetails
      }),
      headers: { 'Content-Type': 'application/json' }
    };
  }
};
