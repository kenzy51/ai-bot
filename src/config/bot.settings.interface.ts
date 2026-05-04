export interface BotSettings {
  clinicId: string;    // <--- Add this line here
  clinicName: string;
  twilioNumber: string; // The ID to find this config
  reportingEmail?: string;
  voiceId: string; // ElevenLabs Voice ID
  personalityType: 'warm' | 'professional' | 'energetic';
  offerPrice: string;
  evaluationValue?: string;
  systemPrompt: string; 
  operatingHours: {
    weekday: { open: string; close: string };
    weekend: { open: string; close: string };
  };
  customKnowledge: string; 
}