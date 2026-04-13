import CoachLayout from '../../components/layouts/CoachLayout';

export default function MatchReportPage() {
  return (
    <CoachLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">Submit Match Report</h1>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <p className="text-lg text-gray-700">
            Match report submission coming soon! This feature will allow you to submit game results, touchdowns, casualties, and MVP selections.
          </p>
        </div>
      </div>
    </CoachLayout>
  );
}
