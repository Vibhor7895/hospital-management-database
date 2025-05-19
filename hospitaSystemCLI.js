require('dotenv').config();
const crypto = require('crypto');
const { MongoClient } = require('mongodb');
const readline = require('readline');

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);
const key = Buffer.from(process.env.ENCRYPTION_KEY, 'utf-8');
const iv = Buffer.from(process.env.ENCRYPTION_IV, 'utf-8');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function encrypt(text) {
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

function decrypt(encryptedText) {
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

async function askQuestion(query) {
  return new Promise(resolve => rl.question(query, ans => resolve(ans)));
}

async function main() {
  try {
    await client.connect();
    const db = client.db('hospital');
    const patients = db.collection('patients');
    const doctors = db.collection('doctors');
    const nurses = db.collection('nurses');

    // Ensure indexes
    await patients.createIndex({ name: 1 });
    await doctors.createIndex({ name: 1 });
    await nurses.createIndex({ name: 1 });

    const type = await askQuestion("Enter user type (patient/doctor/nurse): ");

    if (type.toLowerCase() === 'patient') {
      const name = await askQuestion("Enter patient name: ");
      const diagnosis = await askQuestion("Enter diagnosis: ");
      await patients.insertOne({ name, diagnosis: encrypt(diagnosis) });
      console.log("Patient data saved.");

    } else if (type.toLowerCase() === 'doctor') {
      const name = await askQuestion("Enter doctor name: ");
      const specialty = await askQuestion("Enter specialty: ");
      const notes = await askQuestion("Enter confidential notes: ");
      await doctors.insertOne({ name, specialty, notes: encrypt(notes) });
      console.log("Doctor data saved.");

    } else if (type.toLowerCase() === 'nurse') {
      const name = await askQuestion("Enter nurse name: ");
      const shift = await askQuestion("Enter shift (Morning/Night): ");
      await nurses.insertOne({ name, shift });
      console.log("Nurse data saved.");
    } else {
      console.log("Invalid type.");
    }

    const retrieve = await askQuestion("Do you want to retrieve data? (yes/no): ");
    if (retrieve.toLowerCase() === 'yes') {
      const userType = await askQuestion("Enter type to retrieve (patient/doctor): ");
      const searchName = await askQuestion("Enter name to search: ");

      if (userType === 'patient') {
        const patient = await patients.findOne({ name: searchName });
        if (patient) {
          console.log("Name:", patient.name);
          console.log("Decrypted Diagnosis:", decrypt(patient.diagnosis));
        } else {
          console.log("Patient not found.");
        }
      } else if (userType === 'doctor') {
        const doctor = await doctors.findOne({ name: searchName });
        if (doctor) {
          console.log("Name:", doctor.name);
          console.log("Specialty:", doctor.specialty);
          console.log("Decrypted Notes:", decrypt(doctor.notes));
        } else {
          console.log("Doctor not found.");
        }
      }
    }

  } catch (err) {
    console.error("Error:", err);
  } finally {
    rl.close();
    await client.close();
  }
}

main();
