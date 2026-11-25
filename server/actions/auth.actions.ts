"use server";

import bcrypt from "bcryptjs";
import dbConnect from "@/lib/db";
import { User } from "../db/models";
import { createAction, fail } from "../lib/action";
import { signUpSchema } from "../schemas";

const isDuplicateKey = (error: unknown) =>
  typeof error === "object" && error !== null && (error as { code?: number }).code === 11000;

export const signUpAction = createAction({
  name: "auth.signUp",
  schema: signUpSchema,
  public: true,
  handler: async ({ username, email, password }) => {
    await dbConnect();

    const existingUser = await User.findOne({ email })
      .select("+passwordHash")
      .lean<{ passwordHash?: string | null }>();

    if (existingUser) {
      // a pessoa já entrou antes com Google ou GitHub usando esse e-mail
      if (!existingUser.passwordHash) fail("Este e-mail já está vinculado a uma conta Google ou GitHub.");
      fail("Este e-mail já está cadastrado.", { email: ["Este e-mail já está cadastrado."] });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    try {
      const newUser = await User.create({ username, email, passwordHash });
      return { id: newUser._id.toString(), email: newUser.email };
    } catch (error) {
      // dois cadastros simultâneos com o mesmo e-mail: o índice único segura o segundo
      if (isDuplicateKey(error))
        fail("Este e-mail já está cadastrado.", { email: ["Este e-mail já está cadastrado."] });
      throw error;
    }
  },
});
