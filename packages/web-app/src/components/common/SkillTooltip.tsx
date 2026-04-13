import { useState, useEffect } from 'react';
import { searchSkillOrTrait } from '../../lib/skills-queries';
import type { Skill, Trait } from '../../lib/skills-queries';

interface SkillTooltipProps {
  skill: string;
}

export default function SkillTooltip({ skill }: SkillTooltipProps) {
  const [skillData, setSkillData] = useState<{ type: 'skill' | 'trait', data: Skill | Trait } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function fetchSkillData() {
      setIsLoading(true);
      try {
        const data = await searchSkillOrTrait(skill);
        setSkillData(data);
      } catch (error) {
        console.error('Error fetching skill/trait data:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchSkillData();
  }, [skill]);

  // Clean up skill name for URL (remove spaces, parentheses, etc.)
  const cleanSkillName = skill
    .trim()
    .replace(/\s+\([^)]*\)/g, '') // Remove anything in parentheses like "(3+)"
    .replace(/\s+/g, '_');

  // Link to BB2020 rulebook skills section
  const bb2020Url = `https://www.bloodbowl.com/wp-content/uploads/2020/09/BB_Competition_Rules_2020.pdf`;

  // FUMBBL skills reference
  const fumbblUrl = `https://fumbbl.com/help:Skill#${cleanSkillName}`;

  return (
    <span className="group relative inline-block">
      <span className="cursor-help border-b border-dotted border-gray-400 hover:border-blue-500">
        {skill}
      </span>

      {/* Tooltip */}
      <div className="invisible group-hover:visible absolute z-50 w-80 p-4 mt-2 text-sm bg-gray-900 text-white rounded-lg shadow-lg -left-1/2 transform -translate-x-1/4 pointer-events-none group-hover:pointer-events-auto">
        <div className="font-semibold mb-2 text-base">
          {skill}
          {skillData && (
            <span className="ml-2 text-xs font-normal text-gray-400">
              ({skillData.type === 'skill' ? (skillData.data as Skill).category : 'Trait'})
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="text-xs text-gray-300 mb-2">Loading...</div>
        ) : skillData ? (
          <>
            <div className="text-xs text-gray-200 mb-3 leading-relaxed">
              {skillData.data.description}
            </div>
            {skillData.data.official_reference && (
              <div className="text-xs text-gray-400 italic mb-2">
                {skillData.data.official_reference}
              </div>
            )}
          </>
        ) : (
          <div className="text-xs text-gray-300 mb-2">
            No description available for this skill.
          </div>
        )}

        <div className="text-xs text-gray-400 mb-1 mt-3">External References:</div>
        <div className="flex flex-col gap-1">
          <a
            href={fumbblUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 underline text-xs"
          >
            FUMBBL Reference →
          </a>
          <a
            href={bb2020Url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 underline text-xs"
          >
            BB2020 Rulebook (PDF) →
          </a>
        </div>
        {/* Arrow */}
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 rotate-45 w-2 h-2 bg-gray-900"></div>
      </div>
    </span>
  );
}
