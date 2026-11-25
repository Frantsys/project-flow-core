"use server";

import { ActionResult } from "@/types";
import { SignUpInput, signUpSchema } from "../schemas";
import dbConnect from "@/lib/db";
import { User } from "../db/models";
import bcrypt from "bcryptjs";
import { z } from "zod";

export async function signUpAction(input: SignUpInput): Promise<ActionResult<{ id: string; email: string }>> {
  try {
    const parsed = signUpSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: "Dados de cadastro inválidos.",
        fieldErrors: z.flattenError(parsed.error).fieldErrors,
      };
    }

    const { username, email, password } = parsed.data;

    await dbConnect();

    const existingUser = await User.findOne({ email }).select("+passwordHash").lean();

    if (existingUser) {
      // caso o usuário já tenha entrado antes usando Google ou GitHub com esse e-mail
      if (!existingUser.passwordHash) {
        return {
          success: false,
          error: "Este e-mail já está vinculado a uma conta Google ou GitHub.",
        };
      }

      return {
        success: false,
        error: "Este e-mail já está cadastrado.",
      };
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const newUser = await User.create({
      username,
      email,
      passwordHash,
    });

    return {
      success: true,
      data: {
        id: newUser._id.toString(),
        email: newUser.email,
      },
    };
  } catch (error) {
    console.error("[signUpAction]:", error);
    return {
      success: false,
      error: "Erro interno ao criar conta.",
    };
  }
}
