import { supabase } from '../config/supabase';

export interface Skill {
  id: string;
  name: string;
  category: string;
  description: string;
  official_reference: string;
}

export interface Trait {
  id: string;
  name: string;
  description: string;
  official_reference: string;
}

/**
 * Get all skills
 */
export async function getAllSkills(): Promise<Skill[]> {
  const { data, error } = await supabase
    .from('skills')
    .select('*')
    .order('name', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Get a single skill by name
 */
export async function getSkillByName(name: string): Promise<Skill | null> {
  const { data, error } = await supabase
    .from('skills')
    .select('*')
    .eq('name', name.trim())
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Get all traits
 */
export async function getAllTraits(): Promise<Trait[]> {
  const { data, error } = await supabase
    .from('traits')
    .select('*')
    .order('name', { ascending: true});

  if (error) throw error;
  return data || [];
}

/**
 * Get a single trait by name
 */
export async function getTraitByName(name: string): Promise<Trait | null> {
  const { data, error } = await supabase
    .from('traits')
    .select('*')
    .eq('name', name.trim())
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Search for a skill or trait by name (checks both tables)
 */
export async function searchSkillOrTrait(name: string): Promise<{ type: 'skill' | 'trait', data: Skill | Trait } | null> {
  // Try skills first
  const skill = await getSkillByName(name);
  if (skill) {
    return { type: 'skill', data: skill };
  }

  // Try traits
  const trait = await getTraitByName(name);
  if (trait) {
    return { type: 'trait', data: trait };
  }

  return null;
}
