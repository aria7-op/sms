import { PrismaClient } from '../generated/prisma/client.js';
const prisma = new PrismaClient();

export const getAllDocuments = async (req, res) => {
  const documents = await prisma.document.findMany();
  res.json(documents);
};

export const getDocumentById = async (req, res) => {
  const document = await prisma.document.findUnique({
    where: { id: BigInt(req.params.id) }
  });
  if (!document) return res.status(404).json({ error: 'Document not found' });
  res.json(document);
};

export const createDocument = async (req, res) => {
  const { name, type, path, resource, distention, status } = req.body;
  const document = await prisma.document.create({
    data: { name, type, path, resource, distention, status }
  });
  res.status(201).json(document);
};

export const updateDocument = async (req, res) => {
  const { name, type, path, resource, distention, status } = req.body;
  const document = await prisma.document.update({
    where: { id: BigInt(req.params.id) },
    data: { name, type, path, resource, distention, status }
  });
  res.json(document);
};

export const deleteDocument = async (req, res) => {
  await prisma.document.delete({ where: { id: BigInt(req.params.id) } });
  res.json({ message: 'Document deleted' });
}; 