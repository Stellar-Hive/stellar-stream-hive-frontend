/** Local address book with nicknames stored in localStorage (never sent anywhere). */

const ADDRESS_BOOK_KEY = "address-book-nicknames";

interface AddressBook {
  [address: string]: string;
}

/** Get the nickname for an address, or null if none stored. */
export function getNickname(address: string): string | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = localStorage.getItem(ADDRESS_BOOK_KEY);
    const book = stored ? (JSON.parse(stored) as AddressBook) : {};
    return book[address] || null;
  } catch {
    return null;
  }
}

/** Set the nickname for an address. Pass empty string to remove. */
export function setNickname(address: string, nickname: string): void {
  if (typeof window === "undefined") return;

  try {
    const stored = localStorage.getItem(ADDRESS_BOOK_KEY);
    const book = stored ? (JSON.parse(stored) as AddressBook) : {};

    if (nickname.trim() === "") {
      delete book[address];
    } else {
      book[address] = nickname.trim();
    }

    localStorage.setItem(ADDRESS_BOOK_KEY, JSON.stringify(book));
  } catch {
    // localStorage unavailable
  }
}

/** Get all stored nicknames. */
export function getAllNicknames(): AddressBook {
  if (typeof window === "undefined") return {};

  try {
    const stored = localStorage.getItem(ADDRESS_BOOK_KEY);
    return stored ? (JSON.parse(stored) as AddressBook) : {};
  } catch {
    return {};
  }
}

/** Format an address with its nickname if available. */
export function formatAddressWithNickname(address: string, shortened: string): string {
  const nickname = getNickname(address);
  return nickname ? `${nickname} (${shortened})` : shortened;
}
