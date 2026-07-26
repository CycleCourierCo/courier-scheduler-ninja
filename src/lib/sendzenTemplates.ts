export interface SendZenTemplateComponent {
  type: string;
  text?: string;
  format?: string;
  example?: { body_text?: string[][] };
}

export interface SendZenTemplate {
  name: string;
  language: string;
  category: string;
  components: SendZenTemplateComponent[];
}

export function extractTemplateParams(template: SendZenTemplate): string[] {
  const params: string[] = [];
  for (const comp of template.components) {
    if (comp.type === "BODY" && comp.text) {
      const matches = comp.text.match(/\{\{(\d+)\}\}/g);
      if (matches) {
        matches.forEach((m) => {
          const idx = m.replace(/[{}]/g, "");
          if (!params.includes(idx)) params.push(idx);
        });
      }
    }
  }
  return params.sort((a, b) => Number(a) - Number(b));
}

export function getTemplateBodyText(template: SendZenTemplate): string {
  const body = template.components.find((c) => c.type === "BODY");
  return body?.text || "";
}
