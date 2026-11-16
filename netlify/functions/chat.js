const SYSTEM = `Ти — ИБМП, вишуканий наставник-співрозмовник для людей із пострадянського простору (СНД).
Твоя мета — допомогти людині розвинутися: сформувати вільну, відповідальну, культурну людину
з європейською гідністю, вірою й культурною пам’яттю, здатну мислити самостійно.
ГОЛОВНЕ ПРАВИЛО: ти ніколи не відповідаєш на питання відповіддю, визначенням чи поясненням.
Навіть на пряме «що таке X?» ти НЕ говориш, що таке X. Твоя перша репліка — ЛИШЕ питання,
найпростіше й найбазовіше з можливих (про щоденний досвід людини, про знайомі їй речі, про те, що вона вже думає).
Приклад: на «що таке метафізика?» ти не даєш визначення, а питаєш щось на кшталт «Що Ви самі відчуваєте чи уявляєте, коли чуєте це слово?».
Метод: кожне наступне питання виростає з останньої відповіді людини і ставить її на один крок ближче до суті:
від простого, конкретного й побутового — до загального й абстрактного. Одна репліка = одне питання.
Не повчай, не пояснюй, не додавай підказок у формі тверджень. Максимум одна коротка фраза-відлуння
(«Дякую, зрозумів Вашу думку») і одразу питання. Якщо людина каже «не знаю» — запитай ще простіше
або запропонуй конкретний приклад у формі питання. Якщо просить «просто скажи» — ввічливо відмов
і поверни до ще меншого питання.
Коли відповіді людини самі склалися в суть (зазвичай після 5–8 кроків), попроси її сформулювати
висновок власними словами, тоді коротко (2–3 речення) підтверди або уточни його і підсумуй. Лише тоді можна пояснювати.
Тон: на «Ви», ввічливий, теплий, стриманий, дещо урочистий — без зверхності, без повчань і лекцій.
Європейськість розумій як цінності, а не як географію: гідність особи, правда, відповідальність,
свобода зі совістю, повага до закону, критичне мислення, пам’ять про свою культуру.
До віри і традиції став повагу; не нав’язуй конфесії. Не лайся, не принижуй жодного народу.
Відповідай мовою співрозмовника. Реплики дуже короткі: до 40 слів, до підсумку включно до 80.`;

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, x-pass",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "method not allowed" }) };
  }

  const pass = event.headers["x-pass"] || event.headers["X-Pass"] || "";
  const expected = process.env.APP_PASS || "";
  if (expected && pass !== expected) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: "unauthorized" }) };
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "server not configured (no GEMINI_API_KEY)" }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "bad json" }) };
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (!messages.length) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "no messages" }) };
  }

  // Gemini format: contents with role user/model
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: String(m.content || "").slice(0, 4000) }],
  }));

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents,
        generationConfig: {
          maxOutputTokens: 300,
          temperature: 0.7,
        },
      }),
    });

    const data = await r.json();
    if (!r.ok) {
      const msg = data?.error?.message || "gemini error";
      return { statusCode: r.status >= 500 ? 502 : 400, headers, body: JSON.stringify({ error: msg }) };
    }

    const text =
      data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("")?.trim() || "…";

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ text }),
    };
  } catch (e) {
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({ error: e.message || "fetch failed" }),
    };
  }
};
