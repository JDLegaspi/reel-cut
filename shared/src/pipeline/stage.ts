export type Log = (message: string) => void;

export interface BaseContext {
  name: string;
  log: Log;
}

export interface Stage<Ctx extends BaseContext> {
  name: string;
  inputs(ctx: Ctx): Promise<string[]>;
  outputs(ctx: Ctx): Promise<string[]>;
  run(ctx: Ctx): Promise<void>;
}
