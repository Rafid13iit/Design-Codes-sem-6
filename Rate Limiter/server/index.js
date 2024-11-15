const express = require("express");
const app = express();

app.get("/api/data", (req, res) => {
  res.send({ message: "Data from backend" });
});

app.listen(3001, () => {
  console.log("Backend server running on port 3001");
});
