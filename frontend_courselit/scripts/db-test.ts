import { PublicationStatusEnum } from "@workspace/common-logic/lib/publication_status";
import { QuizModel } from "@workspace/common-logic/models/lms/quiz.model";
import mongoose from "mongoose";


const safeModel = <T>(model: mongoose.Model<T>) => ({
    find: async (query: Partial<T>) => await model.find(query),
    updateMany: async (query: Partial<T>, data: Partial<T>) =>
        model.updateMany(query, data),
    create: async (data: Partial<T>) => await model.create(data)
})

const quizSafeModel = safeModel(QuizModel)
const main = async () => {
    const quiz = await quizSafeModel.create({
        num: 1,
        courseId: "123" as any,
        orgId: "123" as any,
        ownerId: "123" as any,
        publicationStatus: PublicationStatusEnum.DRAFT,
    } as any)
    console.log(quiz)
}
main();