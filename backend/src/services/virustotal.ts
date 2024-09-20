import axios from 'axios';
import FormData from 'form-data';

export const scanFileWithVirusTotal = async (fileBuffer) => {
    try {
        // Create a new FormData instance
        const form = new FormData();

        // Append the file buffer to the form data
        // Filename is optional, but it can be any string to represent the file
        form.append('file', fileBuffer, {
            filename: 'unknown-file.jpg', // You can use any string as filename
            contentType: 'application/octet-stream'
        });

        // Send the file to VirusTotal API
        const response = await axios.post('https://www.virustotal.com/api/v3/files', form, {
            headers: {
                'x-apikey': process.env.VIRUS_TOTAL_KEY, // Your VirusTotal API key
                ...form.getHeaders(), // Include the multipart/form-data headers
            }
        });

        // Return the scan result
        // Get the analysis ID from the response
        const analysisId = response.data.data.id;

        // Construct the link to view the analysis result on VirusTotal
        const analysisLink = `https://www.virustotal.com/gui/file-analysis/${analysisId}`;

        // Return the link and response data
        return {
            analysisLink: analysisLink,
            analysisData: response.data.data
        };
    } catch (error) {
        throw new Error(`Error scanning file with VirusTotal: ${error.response?.data?.message || error.message}`);
    }
};
