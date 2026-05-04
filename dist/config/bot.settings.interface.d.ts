export interface BotSettings {
    clinicId: string;
    clinicName: string;
    twilioNumber: string;
    reportingEmail?: string;
    voiceId: string;
    personalityType: 'warm' | 'professional' | 'energetic';
    offerPrice: string;
    evaluationValue?: string;
    systemPrompt: string;
    operatingHours: {
        weekday: {
            open: string;
            close: string;
        };
        weekend: {
            open: string;
            close: string;
        };
    };
    customKnowledge: string;
}
