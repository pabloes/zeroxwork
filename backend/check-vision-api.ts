import { ImageAnnotatorClient } from '@google-cloud/vision';
import dotenv from "dotenv";

dotenv.config();

const client = new ImageAnnotatorClient();

async function checkVisionAPI() {
    const [result] = await client.safeSearchDetection('public/user-uploaded-images/porn.jpg');
    const detections = result.safeSearchAnnotation;
    console.log('Safe search results:', detections);
}

checkVisionAPI().catch(console.error);
