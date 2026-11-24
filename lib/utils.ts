
/**
 * Função utilitária para gerar um Slug próprio aleatório para um Workspace
 * @param term Termo principal do slug, a princípio será o nome do workspace
 * @returns o slug em string
 */
export const generateWorkspaceSlug = (term: string) => {
    const base = term
        .normalize("NFD") // normaliza acentos
        .replace(/[\u0300-\u036f]/g, "") // remove os acentos
        .toLowerCase() // tudo para minúsculo
        .replace(/[^a-z0-9]+/g, "-") // substitui qualquer espaço, pontuação ou símbolo por hífen
        .replace(/^-+|-+$/g, ""); // remove qualquer hífen no FINAL ou no INÍCIO
        // Gestão & TI -> gestao-&-ti
    
    const suffix = Math.random().toString(36).substring(2, 6); // gera string alfanumérica aleatória de exatamente 4 caracteres
    return `${base}-${suffix}`;
}


