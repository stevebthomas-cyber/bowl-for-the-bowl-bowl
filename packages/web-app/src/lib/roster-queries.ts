import { supabase } from '../config/supabase';
import { RosterTemplate, RosterPosition } from '../types/roster';

export async function getAllRosterTemplates(): Promise<RosterTemplate[]> {
  const { data, error } = await supabase
    .from('roster_templates')
    .select('*')
    .order('team_name');

  if (error) {
    console.error('Error fetching roster templates:', error);
    throw error;
  }

  return data || [];
}

export async function getRosterTemplate(id: string): Promise<RosterTemplate | null> {
  const { data, error } = await supabase
    .from('roster_templates')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching roster template:', error);
    throw error;
  }

  return data;
}

export async function getRosterPositions(rosterTemplateId: string): Promise<RosterPosition[]> {
  const { data, error } = await supabase
    .from('roster_positions')
    .select('*')
    .eq('roster_template_id', rosterTemplateId)
    .order('cost');

  if (error) {
    console.error('Error fetching roster positions:', error);
    throw error;
  }

  return data || [];
}

export async function getRosterWithPositions(rosterTemplateId: string): Promise<{
  template: RosterTemplate;
  positions: RosterPosition[];
}> {
  const [template, positions] = await Promise.all([
    getRosterTemplate(rosterTemplateId),
    getRosterPositions(rosterTemplateId),
  ]);

  if (!template) {
    throw new Error('Roster template not found');
  }

  return { template, positions };
}
