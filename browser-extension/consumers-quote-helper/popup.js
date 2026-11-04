// Toolbar popup: the items waiting for the Product Selector and the vendor sites the helper works on.
async function render() {
  const { vendorDomains = [], picks = [] } = (await chrome.runtime.sendMessage({ type: "popup-state" })) || {};
  const list = document.getElementById("picks");
  list.textContent = "";
  for (const p of picks) {
    const li = document.createElement("li");
    li.textContent = `${p.name || p.model}`;
    const meta = document.createElement("span");
    meta.textContent = ` ${[p.model, p.color].filter(Boolean).join(", ")}${p.price != null ? `, $${p.price}` : ""} x ${p.quantity}`;
    li.appendChild(meta);
    list.appendChild(li);
  }
  document.getElementById("none").hidden = picks.length > 0;
  document.getElementById("sites").textContent = vendorDomains.length
    ? `${vendorDomains.length} vendor sites: ${vendorDomains.join(", ")}`
    : "None yet. Open the Product Selector once.";
}

document.getElementById("clear").addEventListener("click", async () => {
  if (!confirm("Remove every item waiting for the Product Selector?")) return;
  await chrome.runtime.sendMessage({ type: "clear-picks" });
  render();
});

render();
