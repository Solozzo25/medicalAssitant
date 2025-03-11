const axios = require('axios');

        exports.handler = async function(event, context) {
            try {
                // Sprawdzanie metody HTTP
                if (event.httpMethod !== 'POST') {
                    return {
                        statusCode: 405,
                        body: JSON.stringify({ error: 'Method Not Allowed' })
                    };
                }
                
                // Parsowanie danych z żądania
                const requestData = JSON.parse(event.body);
                const { age, sex, symptoms, physicalExam, additionalTests } = requestData;
                
                // Budowanie promptu do GPT
                const systemPrompt = "Jesteś doświadczonym lekarzem medycznym z 20 letnim doświadczeniem w medycynie chorób wewnętrznych, który korzysta z najnowszych wytycznych medycznych.";
                const userPrompt = `
                Twoim zadaniem jest postawienie precyzyjnej diagnozy na podstawie podanych danych pacjenta oraz badań. Do diagnozy przedstaw zwięzłe kilku zdaniowe uzasadnienie, dlaczego taką diagnozę wybrałeś. Dodatkowo chciałbym, abyś postawił również diagnozę różnicową również z kilku zdaniowym uzasadnieniem. Ostatnim zadaniem będzie wskazanie, do jakiego medycznego towarzystwa naukowego skierowałbyś się po zalecenia po zindentyfikowaniu chorob/schorzenia. Masz jedynie podać nazwę np. Polskie Towarzystwko Kardologiczne. Interesują mnie tylko polskie organizacje.
                
                Dane pacjenta:
                - Wiek: ${age}
                - Płeć: ${sex}
                - Wyniki podmiotowe (wywiad lekarski): ${symptoms}
                - Wyniki przedmiotowe (badania przeprowadzone przez lekarza): ${physicalExam}
                - Wyniki laboratoryjne: ${additionalTests}
                
                Format odpowiedzi ma być formatem JSON powinien zawierać 3 sekcje, jak w pożniszym formacie, bez żadnych dodatkowych komentarzy ani modyfikacji nagłówków.
                {
                    "Diagnoza_Główna": "Tutaj opisz najprawdopodobniejszą diagnozę na podstawie podanych danych",
                    "Diagnoza_Różnicowa": "Tutaj opisz alternatywne diagnozy, które należy rozważyć",
                    "Towarzystwo_Medyczne": "Tylko nazwa stowarzyszenia"
                }`;
                
                // Wywołanie API GPT (OpenAI lub alternatywne API)
                const response = await axios.post('https://api.openai.com/v1/chat/completions', {
                    model: "gpt-4-turbo",
                    messages: [
                        {
                            role: "system",
                            content: systemPrompt
                        },
                        {
                            role: "user",
                            content: userPrompt
                        }
                    ]
                }, {
                    headers: {
                        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                // Przetwarzanie odpowiedzi
                const gptResponse = response.data.choices[0].message.content;
                
                // Parsowanie odpowiedzi JSON
                let parsedResponse;
                try {
                    parsedResponse = JSON.parse(gptResponse);
                } catch (e) {
                    // Jeśli GPT nie zwróci prawidłowego JSON, próbujemy wyłuskać dane
                    const mainMatch = gptResponse.match(/"Diagnoza_Główna":\s*"([^"]*)"/);
                    const diffMatch = gptResponse.match(/"Diagnoza_Różnicowa":\s*"([^"]*)"/);
                    const socMatch = gptResponse.match(/"Towarzystwo_Medyczne":\s*"([^"]*)"/);
                    
                    parsedResponse = {
                        Diagnoza_Główna: mainMatch ? mainMatch[1] : "Nie udało się ustalić diagnozy",
                        Diagnoza_Różnicowa: diffMatch ? diffMatch[1] : "Nie udało się ustalić diagnozy różnicowej",
                        Towarzystwo_Medyczne: socMatch ? socMatch[1] : "Nie znaleziono odpowiedniego towarzystwa"
                    };
                }
                
                // Zwracanie odpowiedzi
                return {
                    statusCode: 200,
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(parsedResponse)
                };
                
            } catch (error) {
                console.error('Error processing request:', error);
                
                return {
                    statusCode: 500,
                    body: JSON.stringify({ 
                        error: 'Wystąpił błąd podczas przetwarzania zapytania', 
                        details: error.message 
                    })
                };
            }
        };
