import QuestionsForm from "../components/questions/questionsForm";
import QuestionsCSVImport from "../components/questions/questionsCsvImport";

function AddQuestion() {
    return (
        <div className="space-y-8">
            <QuestionsForm />

            <QuestionsCSVImport />
        </div>
    );
}

export default AddQuestion;