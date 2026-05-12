// Contacts API type augmentations
// https://developer.mozilla.org/en-US/docs/Web/API/Contacts_API
declare global {
  interface Navigator {
    contacts?: {
      select(
        properties: string[],
        options?: { multiple: boolean }
      ): Promise<Contact[]>;
    };
  }

  interface Contact {
    name: string[];
    tel: Array<{ value: string; kind?: string }>;
  }
}

export {};