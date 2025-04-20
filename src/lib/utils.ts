export function waitForNip07(retries = 10, delay = 100): Promise<boolean> {
  return new Promise((resolve) => {
    let attempts = 0;
    const check = () => {
      if (window.nostr) {
        resolve(true);
      } else if (attempts < retries) {
        attempts++;
        setTimeout(check, delay);
      } else {
        resolve(false);
      }
    };
    check();
  });
}
