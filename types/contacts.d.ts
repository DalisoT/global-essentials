// Contacts API (Chrome 86+, Safari 16+)
// https://developer.mozilla.org/en-US/docs/Web/API/Contacts_API
interface Contact {
  name: string[];
  tel: Array<{ value: string; kind?: string }>;
}

interface Navigator {
  contacts?: {
    select: (
      properties: string[],
      options?: { multiple: boolean }
    ) => Promise<Contact[]>;
  };
}