import { PrismaClient } from '../generated/prisma/client.js';
const prisma = new PrismaClient();

export const getAllPasswordResetTokens = async (req, res) => {
  const tokens = await prisma.passwordResetToken.findMany();
  res.json(tokens);
};

export const getPasswordResetTokenById = async (req, res) => {
  const { email, token } = req.params;
  const passwordResetToken = await prisma.passwordResetToken.findUnique({
    where: { email_token: { email, token } }
  });
  if (!passwordResetToken) return res.status(404).json({ error: 'PasswordResetToken not found' });
  res.json(passwordResetToken);
};

export const createPasswordResetToken = async (req, res) => {
  const { email, token, createdAt } = req.body;
  const passwordResetToken = await prisma.passwordResetToken.create({
    data: { email, token, createdAt }
  });
  res.status(201).json(passwordResetToken);
};

export const updatePasswordResetToken = async (req, res) => {
  const { email, token } = req.params;
  const { createdAt } = req.body;
  const passwordResetToken = await prisma.passwordResetToken.update({
    where: { email_token: { email, token } },
    data: { createdAt }
  });
  res.json(passwordResetToken);
};

export const deletePasswordResetToken = async (req, res) => {
  const { email, token } = req.params;
  await prisma.passwordResetToken.delete({ where: { email_token: { email, token } } });
  res.json({ message: 'PasswordResetToken deleted' });
}; 