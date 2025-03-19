// api/gpt-diagnosis.js
const axios = require('axios');

export default async function handler(req, res) {
  console.log("🔄 Funkcja gpt-diagnosis została wywołana");
  
  // Sprawdzenie czy metoda to POST
  if (req.method !== 'POST') {
    console.log("❌ Błąd: Niewłaściwa metoda HTTP:", req.method);
    return res.status(405).json({ 
      error: 'Method Not Allowed' 
    });
  }

  try {
    // Parsowanie danych wejściowych z formularza
    const { age, sex, symptoms, physicalExam, additionalTests, medicalHistory } = req.body;
    
    console.log("📋 Dane pacjenta otrzymane:", { 
      age, 
      sex, 
      symptomsLength: symptoms?.length, 
      physicalExamProvided: !!physicalExam,
      additionalTestsProvided: !!additionalTests,
      medicalHistoryProvided: !!medicalHistory
    });

    // Sprawdzenie wymaganych pól
    if (!age || !sex || !symptoms) {
      console.log("❌ Błąd: Brakujące wymagane pola");
      return res.status(400).json({ 
        error: 'Brakujące wymagane pola: wiek, płeć lub objawy podmiotowe' 
      });
    }

    // Klucz API z zmiennych środowiskowych
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      console.log("❌ Błąd: Brak klucza API OpenAI w zmiennych środowiskowych");
      return res.status(500).json({ 
        error: 'Błąd konfiguracji API - brak klucza OpenAI' 
      });
    }
    
    console.log("🔑 Klucz API OpenAI znaleziony (pierwszych 5 znaków):", apiKey.substring(0, 5) + '...');

    // Przygotowanie systmowego i użytkownika promptu
    const systemPrompt = "Jesteś doświadczonym lekarzem medycznym z 20 letnim doświadczeniem w medycynie chorób wewnętrznych, który korzysta z najnowszych wytycznych medycznych.";
    
    // Przygotowanie promptu do GPT
    const userPrompt = `
      Twoim zadaniem jest postawienie precyzyjnej diagnozy na podstawie podanych danych pacjenta oraz badań. Do diagnozy przedstaw zwięzłe kilku zdaniowe uzasadnienie, dlaczego taką diagnozę wybrałeś. Dodatkowo chciałbym, abyś postawił również diagnozę różnicową również z kilku zdaniowym uzasadnieniem. Ostatnim zadaniem będzie wskazanie, do jakiego medycznego towarzystwa naukowego skierowałbyś się po zalecenia po zindentyfikowaniu chorob/schorzenia. Masz jedynie podać nazwę np. Polskie Towarzystwko Kardologiczne. Interesują mnie tylko polskie organizacje.
      
      Dane pacjenta:
      - Wiek: ${age}
      - Płeć: ${sex}
      - Wyniki podmiotowe (wywiad lekarski): ${symptoms}
      - Wyniki przedmiotowe (badania przeprowadzone przez lekarza): ${physicalExam || 'Brak danych'}
      - Wyniki laboratoryjne: ${additionalTests || 'Brak danych'}
      ${medicalHistory ? `- Historia medyczna: ${medicalHistory}` : ''}
      
      Format odpowiedzi ma być formatem JSON powinien zawierać 5 sekcji, jak w pożniszym formacie, bez żadnych dodatkowych komentarzy ani modyfikacji nagłówków.
      {
          "Diagnoza_Główna": "Tutaj podaj najprawdopodobniejszą diagnozę na podstawie podanych danych. To pole ma zawierać tylko jedną nazwę choroby/schorzenia",
          "Uzasadnienie_Diagnozy": "Tutaj podaj krótkie i zwięzłe uzasdanienie postawionej diagnozy",
          "Diagnoza_Różnicowa": "Tutaj przedstaw najbardziej prawdopodobną diagnozę różnicowa. To pole ma zawierać tylko jedną nazwę choroby/schorzenia",
          "Uzasadnienie_Różnicowe": "Tutaj podaj krótkie i zwięzłe uzasdanienie postawionej diagnozy rożnicowej",
          "Towarzystwo_Medyczne": "Tylko nazwa stowarzyszenia"
      }`;

    console.log("📤 Wysyłanie zapytania do OpenAI API...");
    
    // Konfiguracja zapytania do API OpenAI
    const openAIResponse = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: "gpt-4-turbo", // lub inny model, który preferujesz
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.2, // Niska temperatura dla bardziej precyzyjnych odpowiedzi medycznych
        max_tokens: 1000
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log("✅ Odpowiedź od OpenAI otrzymana, status:", openAIResponse.status);
    console.log("📊 Użycie tokenów:", {
      prompt_tokens: openAIResponse.data.usage?.prompt_tokens,
      completion_tokens: openAIResponse.data.usage?.completion_tokens,
      total_tokens: openAIResponse.data.usage?.total_tokens
    });

    // Parsowanie odpowiedzi od GPT
    const responseContent = openAIResponse.data.choices[0].message.content;
    console.log("📝 Surowa odpowiedź od GPT:", responseContent);
    
    // Próba parsowania JSON z odpowiedzi
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(responseContent);
      console.log("✅ Pomyślnie sparsowano JSON z odpowiedzi");
    } catch (e) {
      console.error("❌ Błąd parsowania JSON z odpowiedzi GPT:", e);
      console.log("📝 Otrzymana odpowiedź (pierwsze 200 znaków):", responseContent.substring(0, 200));
      
      // Spróbujmy znaleźć JSON w odpowiedzi
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        console.log("🔄 Próba wyekstraktowania JSON z odpowiedzi...");
        try {
          parsedResponse = JSON.parse(jsonMatch[0]);
          console.log("✅ Udało się wyekstraktować i sparsować JSON");
        } catch (extractError) {
          console.error("❌ Nieudana ekstrakcja JSON:", extractError);
        }
      }
      
      // Jeśli nadal nie udało się sparsować JSON
      if (!parsedResponse) {
        console.log("❌ Zwracanie oryginalnej odpowiedzi jako tekst");
        return res.status(207).json({ 
          error: "Odpowiedź nie jest poprawnym JSON. Pokazuję tekst oryginalny.", 
          rawResponse: responseContent 
        });
      }
    }

    // Sprawdzenie czy JSON zawiera wymagane pola
    if (!parsedResponse.Diagnoza_Główna || !parsedResponse.Uzasadnienie_Diagnozy || 
        !parsedResponse.Diagnoza_Różnicowa || !parsedResponse.Uzasadnienie_Różnicowe || 
        !parsedResponse.Towarzystwo_Medyczne) {
      
      console.log("⚠️ Niekompletna odpowiedź JSON, brakujące pola:", {
        Diagnoza_Główna: !!parsedResponse.Diagnoza_Główna,
        Uzasadnienie_Diagnozy: !!parsedResponse.Uzasadnienie_Diagnozy,
        Diagnoza_Różnicowa: !!parsedResponse.Diagnoza_Różnicowa,
        Uzasadnienie_Różnicowe: !!parsedResponse.Uzasadnienie_Różnicowe,
        Towarzystwo_Medyczne: !!parsedResponse.Towarzystwo_Medyczne
      });
      
      return res.status(207).json({ 
        warning: "Niekompletna odpowiedź, brakuje wymaganych pól", 
        data: parsedResponse 
      });
    }
    
    console.log("✅ Wszystkie wymagane pola są obecne, zwracanie odpowiedzi");
    console.log("📋 Diagnoza główna:", parsedResponse.Diagnoza_Główna);
    console.log("📋 Diagnoza różnicowa:", parsedResponse.Diagnoza_Różnicowa);
    console.log("📋 Towarzystwo medyczne:", parsedResponse.Towarzystwo_Medyczne);

    // Zwróć odpowiedź do klienta
    return res.status(200).json(parsedResponse);

  } catch (error) {
    console.error("❌ Błąd podczas komunikacji z API:", error);
    
    let errorMessage = 'Wystąpił błąd podczas przetwarzania zapytania';
    let errorDetails = {};
    
    if (error.response) {
      // Błąd po stronie API OpenAI
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
      console.error("❌ Brak odpowiedzi od serwera API");
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
