export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  const APPS_SCRIPT_URL = "https://script.google.com/a/macros/ucmpl.com/s/AKfycbwFlDjuIrUUFDs_cx57CNtHYrPED5mQ9WJ5NtzLxPt4_vE7Eb6Roqp7J0jOQrom6mv8/exec";

  try {
    if (req.method === "GET") {
      const tab = req.query.tab;
      const response = await fetch(`${APPS_SCRIPT_URL}?tab=${tab}`, {
        redirect: "follow",
      });
      const data = await response.json();
      return res.status(200).json(data);
    }

    if (req.method === "POST") {
      const response = await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        redirect: "follow",                          // ← KEY FIX
        body: JSON.stringify(req.body),
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      return res.status(200).json(data);
    }
  } catch (err) {
    return res.status(500).json({ error: err.toString() });
  }
}
