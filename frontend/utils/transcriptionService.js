// frontend/utils/transcriptionService.js
import { toast } from "sonner";

export const initiateTranscription = async (relativeFilePath, fileName) => {
    if (!relativeFilePath || !fileName) {
        toast.error("File path or name is missing.", { title: "Transcription Error" });
        return null; // Return null for missing data
    }

    toast.info(`Requesting transcription for ${fileName}...`, { title: "Transcription Queued" });

    try {
        const response = await fetch('http://localhost:8005/api/transcribe', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                path: relativeFilePath,
                title: fileName,
            }),
        });

        if (response.ok) {
            const result = await response.json();
            console.log("Transcription initiation successful:", result);
            toast.success(`Transcription for ${fileName} successfully queued!`, { title: "Queued!" });
            return 'progress'; 
        } else {
            const errorData = await response.json();
            const errorMessage = errorData.detail || `Server error: ${response.status} - ${response.statusText}`;
            console.error(`Failed to queue transcription for ${fileName}:`, errorMessage);
            toast.error(`Failed to queue ${fileName}: ${errorMessage}`, { title: "Queue Failed" });
            return null;
        }
    } catch (error) {
        console.error(`Network error queuing transcription for ${fileName}:`, error.message);
        toast.error(`Network error queuing ${fileName}: ${error.message}`, { title: "Network Error" });
        return null;
    }
};