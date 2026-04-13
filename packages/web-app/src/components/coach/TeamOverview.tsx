interface TeamOverviewProps {
  team: any;
}

export default function TeamOverview({ team }: TeamOverviewProps) {
  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{team.name}</h2>
          <p className="text-gray-600">{team.race} - Tier {team.tier}</p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-green-600">{team.treasury?.toLocaleString() || 0}g</div>
          <div className="text-sm text-gray-500">Treasury</div>
          <div className="text-lg font-semibold text-gray-700 mt-2">{team.team_value?.toLocaleString() || 0}g</div>
          <div className="text-xs text-gray-500">Team Value</div>
        </div>
      </div>

      {/* Record and Points */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="text-center p-4 bg-blue-50 rounded">
          <div className="text-2xl font-bold text-blue-900">
            {team.wins || 0}-{team.losses || 0}-{team.ties || 0}
          </div>
          <div className="text-sm text-blue-700">Record</div>
        </div>
        <div className="text-center p-4 bg-purple-50 rounded">
          <div className="text-2xl font-bold text-purple-900">{team.league_points || 0}</div>
          <div className="text-sm text-purple-700">League Points</div>
        </div>
        <div className="text-center p-4 bg-green-50 rounded">
          <div className="text-2xl font-bold text-green-900">{team.dedicated_fans || 0}</div>
          <div className="text-sm text-green-700">Dedicated Fans</div>
        </div>
        <div className="text-center p-4 bg-orange-50 rounded">
          <div className="text-2xl font-bold text-orange-900">{team.rerolls || 0}</div>
          <div className="text-sm text-orange-700">Team Rerolls</div>
        </div>
      </div>

      {/* Staff */}
      <div className="border-t pt-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Team Staff</h3>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Assistant Coaches:</span>
            <span className="font-semibold text-gray-900">{team.assistant_coaches || 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Cheerleaders:</span>
            <span className="font-semibold text-gray-900">{team.cheerleaders || 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Apothecary:</span>
            <span className="font-semibold text-gray-900">{team.apothecary_hired ? 'Yes' : 'No'}</span>
          </div>
        </div>
      </div>

      {/* Additional Stats */}
      {team.total_sobs !== undefined && (
        <div className="border-t pt-4 mt-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Season Stats</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Total SOBs:</span>
              <span className="font-semibold text-gray-900">{team.total_sobs || 0}</span>
            </div>
            {team.division && (
              <div className="flex justify-between">
                <span className="text-gray-600">Division:</span>
                <span className="font-semibold text-gray-900">{team.division}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-600">Status:</span>
              <span className={`font-semibold ${team.active ? 'text-green-600' : 'text-red-600'}`}>
                {team.active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
