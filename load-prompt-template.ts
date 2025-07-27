import fs from 'fs';
import yaml from 'js-yaml';

export function loadPromptTemplates(yamlPath: string, fallback?: any): any {
  if (fs.existsSync(yamlPath)) {
    const fileContents = fs.readFileSync(yamlPath, 'utf8');
    return yaml.load(fileContents);
  }
  return fallback;
}

const r = loadPromptTemplates('src/prompts/toolcalling_agent.yaml');
console.log(r);
