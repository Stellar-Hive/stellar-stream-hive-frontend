export default function Error({ error, reset }: any) {
  return (
    <div role="alert">
      <h2>Error</h2>
      <button onClick={reset}>Retry</button>
      <a href="/streams">Back</a>
    </div>
  );
}
