// netlify/functions/gpt-diagnosis.js
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
    // Parsowanie danych wejściowych z formularza
    const requestData = JSON.parse(event.body);
    const { age, sex, symptoms, physicalExam, additionalTests, medicalHistory } = requestData;

    // Sprawdzenie wymaganych pól
    if (!age || !sex || !symptoms) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Brakujące wymagane pola: wiek, płeć lub objawy podmiotowe' }),
        headers: { 'Content-Type': 'application/json' }
      };
    }

    // Klucz API z zmiennych środowiskowych Netlify
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Błąd konfiguracji API' }),
        headers: { 'Content-Type': 'application/json' }
      };
    }

    // Przygotowanie systmowego i użytkownika promptu
    const systemPrompt = "Jesteś doświadczonym lekarzem medycznym z 20 letnim doświadczeniem w medycynie chorób wewnętrznych, który korzysta z najnowszych wytycznych medycznych.";
    
    const userPrompt = `
      Twoim zadaniem jest postawienie precyzyjnej diagnozy na podstawie podanych danych pacjenta oraz badań. Do diagnozy przedstaw zwięzłe kilku zdaniowe uzasadnienie, dlaczego taką diagnozę wybrałeś. Dodatkowo chciałbym, abyś postawił również diagnozę różnicową również z kilku zdaniowym uzasadnieniem. Ostatnim zadaniem będzie wskazanie, do jakiego medycznego towarzystwa naukowego skierowałbyś się po zalecenia po zindentyfikowaniu chorob/schorzenia. Masz jedynie podać nazwę np. Polskie Towarzystwko Kardologiczne. Interesują mnie tylko polskie organizacje.
      
      
      Dane pacjenta, na podstawie których musisz postawic diagnozę:
      - Wiek: ${age}
      - Płeć: ${sex}
      - Wyniki podmiotowe (wywiad lekarski): ${symptoms}
      - Wyniki przedmiotowe (badania przeprowadzone przez lekarza): ${physicalExam || 'Brak danych'}
      - Wyniki laboratoryjne: ${additionalTests || 'Brak danych'}
      ${medicalHistory ? `- Historia medyczna: ${medicalHistory}` : ''}
      
      Format odpowiedzi ma być formatem JSON powinien zawierać 3 sekcje, jak w pożniszym formacie, bez żadnych dodatkowych komentarzy ani modyfikacji nagłówków.
      {
          "Diagnoza_Główna": "Tutaj opisz najprawdopodobniejszą diagnozę na podstawie podanych danych",
          "Diagnoza_Różnicowa": "Tutaj opisz alternatywne diagnozy, które należy rozważyć",
          "Towarzystwo_Medyczne": "Tylko nazwa stowarzyszenia"
      }`;

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

    // Parsowanie odpowiedzi od GPT
    const responseContent = openAIResponse.data.choices[0].message.content;
    
    // Próba parsowania JSON z odpowiedzi
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(responseContent);
    } catch (e) {
      console.error("Błąd parsowania JSON z odpowiedzi GPT:", e);
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
    if (!parsedResponse.Diagnoza_Główna || !parsedResponse.Uzasadnienie_Diagnozy || 
        !parsedResponse.Diagnoza_Różnicowa || !parsedResponse.Uzasadnienie_Różnicowe || 
        !parsedResponse.Towarzystwo_Medyczne) {
      return {
        statusCode: 207, // Partial Content
        body: JSON.stringify({ 
          warning: "Niekompletna odpowiedź, brakuje wymaganych pól", 
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
    console.error("Błąd podczas komunikacji z API:", error);
    
    let errorMessage = 'Wystąpił błąd podczas przetwarzania zapytania';
    let statusCode = 500;
    
    if (error.response) {
      // Błąd po stronie API OpenAI
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

