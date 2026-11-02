/** Validator for the official EBF1 schema, generated at build time (ebf1Validator plugin in vite.config.ts). */
declare module 'virtual:ebf1-validator' {
    interface ValidationError {
        /** JSON Pointer path of the field, e.g.: "/bible/books/0/abbreviation". */
        instancePath: string;
        message?: string;
    }
    const validate: ((data: unknown) => boolean) & { errors?: ValidationError[] | null };
    export default validate;
}
