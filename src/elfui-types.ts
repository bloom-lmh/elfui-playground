// Browser-facing declarations for Monaco. The runtime compiler remains the
// source of truth; this facade gives the editor the common authoring surface
// without bundling the full Node-oriented declaration graph into every page.
export const elfuiTypeDefinitions = `
declare module "@elfui/core" {
  export interface Ref<T> {
    value: T;
    peek(): T;
    set(value: T): void;
  }

  export interface Computed<T> extends Readonly<Ref<T>> {}
  export interface MacroTemplate { readonly __elfuiMacroTemplate: unique symbol }

  export function useRef<T>(value: T): Ref<T>;
  export function useReactive<T extends object>(value: T): T;
  export function useComputed<T>(getter: () => T): Computed<T>;
  export const computed: typeof useComputed;
  export function useEffect(effect: () => void | (() => void)): () => void;
  export function watch<T>(source: Ref<T> | (() => T), callback: (value: T, previous: T | undefined) => void): () => void;

  export function html(strings: TemplateStringsArray, ...values: unknown[]): MacroTemplate;
  export function css(strings: TemplateStringsArray, ...values: unknown[]): string;
  export function defineHtml<T = unknown>(template: MacroTemplate): T;
  export function defineProps<T extends object>(options?: unknown): Readonly<T>;
  export function defineEmits<T extends Record<string, unknown[]>>(): <K extends keyof T>(event: K, ...args: T[K]) => void;
  export function defineModel<T>(options?: unknown): Ref<T>;
  export function defineSlots<T extends object>(): T;
  export function defineStyle(style: string): void;
  export function defineName(name: string): void;
  export function defineOptions(options: Record<string, unknown>): void;
  export function useComponents(components: Record<string, unknown>): void;
  export function createApp(component: unknown): { mount(target: string | Element): Element; unmount(): void };
  export function registerComponents(...components: unknown[]): void;
}
`;
