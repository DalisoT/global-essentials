declare module 'papaparse' {
  interface ParseResult {
    data: any[];
    errors: any[];
    meta: {
      fields?: string[];
    };
  }
  interface Papa {
    parse(file: File, config: {
      header?: boolean;
      skipEmptyLines?: boolean;
      complete: (results: ParseResult) => void;
      error?: (error: any) => void;
    }): void;
  }
  const Papa: Papa;
  export = Papa;
}