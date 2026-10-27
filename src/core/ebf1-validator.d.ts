/** Validador do schema oficial do EBF1, gerado no build (plugin ebf1Validator do vite.config.ts). */
declare module 'virtual:ebf1-validator' {
    interface ValidationError {
        /** Caminho JSON Pointer do campo, ex.: "/bible/books/0/abbreviation". */
        instancePath: string;
        message?: string;
    }
    const validate: ((data: unknown) => boolean) & { errors?: ValidationError[] | null };
    export default validate;
}
