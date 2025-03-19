// js/api.js

/**
 * Funkcja do wysyłania zapytania do API OpenAI za pośrednictwem Vercel API
 * @param {Object} patientData - Dane pacjenta z formularza
 * @param {number} maxRetries - Maksymalna liczba prób (domyślnie 3)
 * @returns {Promise<Object>} - Promise z odpowiedzią zawierającą diagnozy
 */
async function getDiagnosis(patientData, maxRetries = 3) {
  console.log("📤 Wywołanie funkcji getDiagnosis");
  
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Próba połączenia z API (${attempt}/${maxRetries})...`);
      
      // Zmieniona ścieżka z /.netlify/functions/gpt-diagnosis na /api/gpt-diagnosis
      const response = await fetch('/api/gpt-diagnosis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(patientData)
      });

      const responseData = await response.json();
      
      if (!response.ok) {
        console.error("❌ Odpowiedź z błędem:", {
          status: response.status,
          data: responseData
        });
        
        // Dla błędów 502 i 504 - ponów próbę
        if ((response.status === 502 || response.status === 504) && attempt < maxRetries) {
          const delay = 2000 * attempt; // 2s, 4s, 6s...
          console.log(`⚠️ Błąd ${response.status}, ponowna próba za ${delay/1000} sekund...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue; // Przejdź do następnej iteracji pętli
        }
        
        throw new Error(responseData.error || `Błąd serwera: ${response.status}`);
      }
      
      console.log("✅ Otrzymano odpowiedź z API Vercel, status:", response.status);
      
      // Sprawdź czy mamy warning w odpowiedzi
      if (responseData.warning) {
        console.warn("⚠️ Ostrzeżenie w odpowiedzi:", responseData.warning);
        // Jeśli jest data, użyj jej, mimo ostrzeżenia
        if (responseData.data) {
          console.log("🔄 Zwracanie częściowych danych mimo ostrzeżenia");
          return responseData.data;
        }
      }

      return responseData;
    } catch (error) {
      console.error(`❌ Błąd podczas próby ${attempt}/${maxRetries}:`, error);
      lastError = error;
      
      // Jeśli to nie jest ostatnia próba, poczekaj przed ponowieniem
      if (attempt < maxRetries) {
        const delay = 2000 * attempt; // 2s, 4s, 6s...
        console.log(`⏱️ Oczekiwanie ${delay/1000}s przed ponowną próbą...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  // Jeśli dotarliśmy tutaj, wszystkie próby się nie powiodły
  console.error(`❌ Wszystkie ${maxRetries} próby nieudane.`);
  throw lastError || new Error('Nie udało się połączyć z API po kilku próbach');
}

/**
 * Funkcja do wysyłania zapytania do API Perplexity za pośrednictwem Vercel API
 * @param {Object} diagnosisData - Dane zawierające diagnozę i towarzystwo medyczne
 * @param {number} maxRetries - Maksymalna liczba prób (domyślnie 3)
 * @returns {Promise<Object>} - Promise z odpowiedzią zawierającą rekomendacje leczenia
 */
async function getTreatmentRecommendations(diagnosisData, maxRetries = 3) {
  console.log("📤 Wywołanie funkcji getTreatmentRecommendations");
  
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Upewniamy się, że przekazujemy tylko diagnozę i towarzystwo medyczne
      const requestData = {
        diagnosis: diagnosisData.diagnosis,
        medicalSociety: diagnosisData.medicalSociety
      };
      
      console.log(`🔄 Próba połączenia z API Perplexity (${attempt}/${maxRetries})...`);
      console.log("📋 Dane diagnoza:", requestData.diagnosis);
      console.log("📋 Dane towarzystwo:", requestData.medicalSociety);
      
      // Zmieniona ścieżka z /.netlify/functions/perplexity-treatment na /api/perplexity-treatment
      const response = await fetch('/api/perplexity-treatment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      });

      const responseData = await response.json();
      
      if (!response.ok) {
        console.error("❌ Odpowiedź z błędem:", {
          status: response.status,
          data: responseData
        });
        
        // Dla błędów 502 i 504 - ponów próbę
        if ((response.status === 502 || response.status === 504) && attempt < maxRetries) {
          const delay = 2000 * attempt; // 2s, 4s, 6s...
          console.log(`⚠️ Błąd ${response.status}, ponowna próba za ${delay/1000} sekund...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue; // Przejdź do następnej iteracji pętli
        }
        
        throw new Error(responseData.error || `Błąd serwera: ${response.status}`);
      }
      
      console.log("✅ Otrzymano odpowiedź z API Vercel, status:", response.status);
      
      // Sprawdź czy mamy warning w odpowiedzi
      if (responseData.warning) {
        console.warn("⚠️ Ostrzeżenie w odpowiedzi:", responseData.warning);
        // Jeśli jest data, użyj jej, mimo ostrzeżenia
        if (responseData.data) {
          console.log("🔄 Zwracanie częściowych danych mimo ostrzeżenia");
          return responseData.data;
        }
      }

      return responseData;
    } catch (error) {
      console.error(`❌ Błąd podczas próby ${attempt}/${maxRetries}:`, error);
      lastError = error;
      
      // Jeśli to nie jest ostatnia próba, poczekaj przed ponowieniem
      if (attempt < maxRetries) {
        const delay = 2000 * attempt; // 2s, 4s, 6s...
        console.log(`⏱️ Oczekiwanie ${delay/1000}s przed ponowną próbą...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  // Jeśli dotarliśmy tutaj, wszystkie próby się nie powiodły
  console.error(`❌ Wszystkie ${maxRetries} próby nieudane.`);
  throw lastError || new Error('Nie udało się połączyć z API po kilku próbach');
}

/**
 * Funkcja do eksportu wyników do PDF
 * @param {Object} diagnosisData - Dane diagnozy
 * @param {Object} treatmentData - Dane rekomendacji leczenia
 * @param {Object} patientData - Dane pacjenta
 */
function exportToPDF(diagnosisData, treatmentData, patientData) {
  // Tutaj implementacja eksportu do PDF
  // Można użyć biblioteki jak jsPDF czy html2pdf
  alert('Funkcja eksportu do PDF będzie zaimplementowana w przyszłości.');
}
