export const Bad = ({ text }: { text: string }) => (
  <div>
    <p>Please answer on your phone.</p>
    <img src="/x.png" alt="A chart of the answers" />
    <p>{text}</p>
    <span data-role="count">{text.length}</span>
  </div>
);
