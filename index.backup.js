const express = require("express");
const cors = require("cors");

const app = express();
const PORT = 5050;

app.use(cors());

app.get("/health", (req, res) => {
  res.json({
    status: "API Online"
  });
});

app.listen(PORT, () => {
  console.log(`Scanner API running on http://localhost:${PORT}`);
});
