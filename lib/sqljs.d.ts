declare module "sql.js" {
  export type SqlValue = string | number | null | Uint8Array;

  export interface QueryExecResult {
    columns: string[];
    values: SqlValue[][];
  }

  export interface Statement {
    bind(values?: Record<string, SqlValue> | SqlValue[]): boolean;
    step(): boolean;
    getAsObject(): Record<string, SqlValue>;
    free(): boolean;
    run(values?: SqlValue[]): void;
  }

  export class Database {
    constructor(data?: ArrayLike<number> | Buffer);
    run(sql: string, params?: SqlValue[]): Database;
    exec(sql: string): QueryExecResult[];
    prepare(sql: string): Statement;
    export(): Uint8Array;
    close(): void;
  }

  export interface SqlJsStatic {
    Database: typeof Database;
  }

  export interface InitSqlJsConfig {
    locateFile?: (file: string) => string;
    wasmBinary?: ArrayBuffer;
  }

  export default function initSqlJs(config?: InitSqlJsConfig): Promise<SqlJsStatic>;
}
