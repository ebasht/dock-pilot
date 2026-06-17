import { en } from "./en";
import { ru } from "./ru";

export const messages = { en, ru } as const;

type DeepStringRecord<T> = {
  [K in keyof T]: T[K] extends object ? DeepStringRecord<T[K]> : string;
};

export type Messages = DeepStringRecord<typeof en>;
