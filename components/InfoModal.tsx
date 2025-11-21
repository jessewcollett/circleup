import React from 'react';

interface InfoModalProps {
  onReplayTour?: () => void;
}

const InfoModal: React.FC<InfoModalProps> = ({ onReplayTour }) => {
    
  const Section: React.FC<{title: string, children: React.ReactNode}> = ({ title, children }) => (
    <div>
      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">{title}</h3>
      <div className="space-y-2 text-gray-600 dark:text-gray-400 text-sm">
        {children}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold text-blue-600 dark:text-blue-400">Our Goal</h2>
        <p className="mt-1 text-gray-700 dark:text-gray-300">To help you pursue meaningful and active connection to others.</p>
        <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mt-2">Why?</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Life gets busy. CircleUp is a simple, private space to help you be more intentional about nurturing the important relationships in your life.</p>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 my-4"></div>

      <Section title="How to Use CircleUp">
        <ul className="space-y-3 list-disc list-inside">
          <li>
            <strong>Dashboard:</strong> This is your home base! It shows who you're overdue to connect with based on the goals you set. Swipe left to log a quick check-in, swipe right to snooze for a day, or tap to log a detailed connection.
          </li>
          <li>
            <strong>People & Groups:</strong> This is your address book. Add individuals and groups, and set a "Connection Goal" for each to tell the app how often you'd like to connect.
          </li>
          <li>
            <strong>Dashboard Reminders:</strong> Prefer to be reminded about a group instead of its individual members? Edit a person and uncheck "Show on Dashboard for reminders" to hide them from your main list.
          </li>
          <li>
            <strong>Logging Connections:</strong> Use the Log button (bottom-left) to record any interaction (a call, text, or visit). This updates the "last connected" date for everyone involved.
          </li>
          <li>
            <strong>Activities:</strong> Plan future hangouts, trips, or calls. Set a date or leave it as "TBD." You can even add it to your Google Calendar.
          </li>
          <li>
            <strong>Ask a Friend:</strong> Keep track of favors or support you might need. The app helps you remember who you asked last, so you can easily rotate next time.
          </li>
          <li>
            <strong>Generate Ideas:</strong> Use the ✨ button in the header to get AI-powered suggestions for activities, gifts, or food based on your friends' saved interests!
          </li>
        </ul>
      </Section>

      <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={() => {
            if (onReplayTour) onReplayTour();
            else window.dispatchEvent(new Event('circleup:startOnboarding'));
          }}
          className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium"
        >
          Take a Tour
        </button>
      </div>
    </div>
  );
};

export default InfoModal;