"use client";

import { GeneralRouterOutputs } from "@/server/api/types";
import { trpc } from "@/utils/trpc";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import {
  Bot,
  Clock,
  FileText,
  Loader2,
  Star,
  Users
} from "lucide-react";
import { useState } from "react";
import { useAssignmentContext } from "./assignment-context";

type SubmissionType =
  GeneralRouterOutputs["lmsModule"]["assignmentModule"]["assignmentSubmission"]["listSubmissions"]["items"][number];

export default function AssignmentSubmissions() {
  const { assignment } = useAssignmentContext();
  const [selectedSubmissions, setSelectedSubmissions] = useState<
    SubmissionType[]
  >([]);
  const [isAiGrading, setIsAiGrading] = useState(false);

  const submissionsQuery =
    trpc.lmsModule.assignmentModule.assignmentSubmission.listSubmissions.useQuery(
      {
        filter: {
          assignmentId: assignment?._id?.toString(),
        },
        pagination: {
          take: 50,
          skip: 0,
        },
      },
    );

  const submissions = submissionsQuery.data?.items || [];

  const handleSelectSubmission = (
    submission: SubmissionType,
    checked: boolean,
  ) => {
    if (checked) {
      setSelectedSubmissions((prev) => [...prev, submission]);
    } else {
      setSelectedSubmissions((prev) =>
        prev.filter((id) => id._id !== submission._id),
      );
    }
  };
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedSubmissions(
        submissions.filter((s) => s.score === null).map((s) => s),
      );
    } else {
      setSelectedSubmissions([]);
    }
  };

  const handleAiBulkGrade = async () => {
    if (selectedSubmissions.length === 0) return;
  };

  const confirmAiGrades = () => {};

  const openGradingModal = (submission: any) => {
    // setSelectedSubmission(submission)
    // setGradeInput(submission.grade?.toString() || "")
    // setFeedbackInput(submission.feedback || "")
  };

  return (
    <>
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{submissions.length}</p>
                <p className="text-sm text-muted-foreground">
                  Total Submissions
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">
                  {submissions.filter((s) => s.score === 0 || !s.score).length}
                </p>
                <p className="text-sm text-muted-foreground">Graded</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">
                  {submissions.filter((s) => s.score === 0 || !s.score).length}
                </p>
                <p className="text-sm text-muted-foreground">Pending Review</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-2xl font-bold">
                  {submissions.filter((s) => s.latePenaltyApplied).length}
                </p>
                <p className="text-sm text-muted-foreground">
                  Late Submissions
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Student Submissions</CardTitle>
          <div className="flex gap-2">
            {selectedSubmissions.length > 0 && (
              <>
                <Button
                  variant="outline"
                  onClick={handleAiBulkGrade}
                  disabled={isAiGrading}
                >
                  {isAiGrading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Bot className="h-4 w-4 mr-2" />
                  )}
                  AI Bulk Grade ({selectedSubmissions.length})
                </Button>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={
                      selectedSubmissions.length ===
                        submissions.filter((s) => s.score === null).length &&
                      submissions.filter((s) => s.score === null).length > 0
                    }
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {submissions.map((submission) => (
                <TableRow key={submission.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedSubmissions.some(
                        (s) => s._id === submission._id,
                      )}
                      onCheckedChange={(checked) =>
                        handleSelectSubmission(submission, checked as boolean)
                      }
                      disabled={submission.score !== null}
                    />
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {submission.student.name}
                        {submission.aiGraded && (
                          <Badge variant="secondary" className="text-xs">
                            <Bot className="h-3 w-3 mr-1" />
                            AI Graded
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {submission.student.email}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {new Date(submission.submittedAt).toLocaleDateString()}
                      <div className="text-xs text-muted-foreground">
                        {new Date(submission.submittedAt).toLocaleTimeString()}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        submission.isLate
                          ? "destructive"
                          : submission.grade !== null
                            ? "default"
                            : "secondary"
                      }
                    >
                      {submission.isLate
                        ? "Late"
                        : submission.grade !== null
                          ? "Graded"
                          : "Pending"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {submission.score !== null ? (
                      <div className="font-medium">
                        {submission.score}/{assignment?.totalPoints}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Not graded</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => openGradingModal(submission)}
                        >
                          <Star className="h-4 w-4 mr-2" />
                          {submission.grade !== null
                            ? "Edit Grade"
                            : "Grade Submission"}
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Download className="h-4 w-4 mr-2" />
                          Download Files
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Send Feedback
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table> */}
        </CardContent>
      </Card>
    </>
  );
}
