// api/perplexity-treatment.js
const axios = require('axios');

export default async function handler(req, res) {
  console.log("🔄 Funkcja perplexity-treatment została wywołana");
  
  // Sprawdzenie czy metoda to POST
  if (req.method !== 'POST') {
    console.log("❌ Błąd: Niewłaściwa metoda HTTP:", req.method);
    return res.status(405).json({ 
      error: 'Method Not Allowed' 
    });
  }

  try {
    // Parsowanie danych wejściowych
    const { diagnosis, medicalSociety } = req.body;
    
    console.log("📋 Dane otrzymane:", { 
      diagnosis, 
      medicalSociety
    });

    // Sprawdzenie wymaganych pól
    if (!diagnosis || !medicalSociety) {
      console.log("❌ Błąd: Brakuje wymaganych pól");
      return res.status(400).json({ 
        error: 'Brakuje diagnozy lub towarzystwa medycznego do przygotowania rekomendacji leczenia' 
      });
    }

    // Klucz API z zmiennych środowiskowych
    const apiKey = process.env.PERPLEXITY_API_KEY;
    
    if (!apiKey) {
      console.log("❌ Błąd: Brak klucza API Perplexity w zmiennych środowiskowych");
      return res.status(500).json({ 
        error: 'Błąd konfiguracji API - brak klucza Perplexity' 
      });
    }
    
    console.log("🔑 Klucz API Perplexity znaleziony (pierwszych 5 znaków):", apiKey.substring(0, 5) + '...');

    // Przygotowanie promptu do Perplexity
    const prompt = `
      Dla następującej diagnozy: "${diagnosis}", chcę abyś znalazł w materiałach tylko i wyłącznie "${medicalSociety}" jakie są wytyczne oraz rekomendacje leczenia takiej choroby. Podziel odpowiedź na dwie sekcje - farmakologiczne i niefarmalogiczne. Wyszukaj charakterystykę kluczowego leku zalecanego w terapii, bazując na OFICJALNEJ, RZĄDOWEJ charakterystyce produktu leczniczego (np. z URPL, EMA lub innego oficjalnego źródła) oraz wyekstraktuj informacje dotyczące: Wskazań oraz przeciwskazań
Interakcje z innymi lekami.
     
      Twoja odpowiedź musi zawierać:
      1. Szczegółową farmakoterapię według oficjalnych wytycznych: nazwę produktu leczniczego, dawkowanie, czas leczenia
      2. Zalecenia niefarmakologiczne rekomendowane przez towarzystwo
      3. Charakterystykę kluczowego leku zalecanego w terapii, bazując na OFICJALNEJ, RZĄDOWEJ charakterystyce produktu leczniczego (np. z URPL, EMA lub innego oficjalnego źródła)
         - Interakcje z innymi lekami (najważniejsze)
         - Wskazania
         - Przeciwwskazania
     
      Zwróć odpowiedź w formacie JSON:
      {
        "Farmakoterapia": [lista leków wraz z dawkowaniem],
        "Zalecenia_Niefarmakologiczne": [lista zaleceń],
        "Charakterystyka_Leku": {
          "Nazwa": "nazwa leku",
          "Wskazania": [lista wskazań z oficjalnego źródła],
          "Przeciwwskazania": [lista przeciwwskazań z oficjalnego źródła],
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
      return res.status(207).json({ 
        error: "Odpowiedź nie jest poprawnym JSON. Pokazuję tekst oryginalny.", 
        rawResponse: responseContent 
      });
    }

    // Sprawdzenie czy JSON zawiera wymagane pola
    const requiredFields = ['Farmakoterapia', 'Zalecenia_Niefarmakologiczne', 'Charakterystyka_Leku'];
    const missingFields = requiredFields.filter(field => !parsedResponse[field]);
    
    if (missingFields.length > 0) {
      console.log("⚠️ Niekompletna odpowiedź JSON, brakujące pola:", missingFields);
      return res.status(207).json({ 
        warning: `Niekompletna odpowiedź, brakuje wymaganych pól: ${missingFields.join(', ')}`, 
        data: parsedResponse 
      });
    }
    
    // Sprawdzenie czy charakterystyka leku zawiera wszystkie wymagane pola
    const drugFields = ['Nazwa', 'Wskazania', 'Przeciwwskazania', 'Interakcje'];
    const missingDrugFields = drugFields.filter(field => !parsedResponse.Charakterystyka_Leku[field]);
    
    if (missingDrugFields.length > 0) {
      console.log("⚠️ Niekompletna charakterystyka leku, brakujące pola:", missingDrugFields);
      return res.status(207).json({ 
        warning: `Niekompletna charakterystyka leku, brakuje pól: ${missingDrugFields.join(', ')}`, 
        data: parsedResponse 
      });
    }
    
    console.log("✅ Wszystkie wymagane pola są obecne, zwracanie odpowiedzi");
    console.log("📋 Lek główny:", parsedResponse.Charakterystyka_Leku.Nazwa);
    
    // Zwróć odpowiedź do klienta
    return res.status(200).json(parsedResponse);

  } catch (error) {
    console.error("❌ Błąd podczas komunikacji z API Perplexity:", error);
    
    let errorMessage = 'Wystąpił błąd podczas przetwarzania zapytania';
    let errorDetails = {};
    
    if (error.response) {
      // Błąd po stronie API Perplexity
      console.error("❌ Odpowiedź z błędem od API:", {
        status: error.response.status,
        data: error.response.data
      });
      
      errorMessage = `Błąd API: ${error.response.status} - ${error.response.data.error?.message || JSON.stringify(error.response.data)}`;
      errorDetails = {
        status: error.response.status,
        message: error.response.data.error?.message,
        type: error.response.data.error?.type
      };
    } else if (error.request) {
      // Brak odpowiedzi od API
      console.error("❌ Brak odpowiedzi od serwera API Perplexity");
      errorMessage = 'Brak odpowiedzi od serwera API';
    } else {
      // Inny błąd
      console.error("❌ Nieoczekiwany błąd:", error.message);
      errorDetails = { message: error.message };
    }
    
    return res.status(500).json({ 
      error: errorMessage,
      details: errorDetails
    });
  }
}
