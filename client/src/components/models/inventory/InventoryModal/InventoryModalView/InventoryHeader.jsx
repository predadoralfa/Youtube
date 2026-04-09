export function InventoryHeader({ onClose }) {
  return (
    <div className="inv-header">
      <h2>INVENTORY</h2>
      <button onClick={onClose}>X</button>
    </div>
  );
}
