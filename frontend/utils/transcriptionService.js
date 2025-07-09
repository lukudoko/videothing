import { toast } from '@/lib/toast'; // Your custom toast
import { HiCheck, HiMinusCircle, HiInformationCircle } from "react-icons/hi"; // Added HiInformationCircle


export const initiateTranscription = async (relativeFilePath, fileName) => {
    if (!relativeFilePath || !fileName) {
        toast.error("File path or name is missing.", { title: "Transcription Error" });
        return null; // Return null for missing data
    }

    try {
        const response = await fetch('/api/transcribe', {
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

            toast({
                title: "Queued!",
                description: `Successfully queued ${fileName} for transcription!.`,
                type: 'success',
                icon: HiCheck,
            });

            return 'progress';
        } else {
            const errorData = await response.json();
            const errorMessage = errorData.detail || `Server error: ${response.status} - ${response.statusText}`;
            console.error(`Failed to queue transcription for ${fileName}:`, errorMessage);
            toast({
                title: "Queue Failed",
                description: `Failed to queue ${fileName}: ${error.message}`,
                type: 'error',
                icon: HiMinusCircle,
            });
            return null;
        }
    } catch (error) {
        console.error(`Network error queuing transcription for ${fileName}:`, error.message);
        toast({
            title: "Network Error",
            description: `Network error queuing ${fileName}: ${error.message}`,
            type: 'error',
            icon: HiMinusCircle,
        });
        return null;
    }
};