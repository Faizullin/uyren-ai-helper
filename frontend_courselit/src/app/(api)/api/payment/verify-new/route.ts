import { NextRequest } from "next/server";
import InvoiceModel from "@/models/Invoice";
import MembershipModel from "@/models/Membership";
import { getDomainData } from "@/server/lib/domain";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { Log } from "@/lib/logger";
import { getUser } from "../helpers";

interface RequestPayload {
  id: string;
}

export async function POST(req: NextRequest) {
  const body: RequestPayload = await req.json();

  try {
    const domainData = await getDomainData();
    if (!domainData.domainObj) {
      return Response.json({ message: "Domain not found" }, { status: 404 });
    }

    const session = await getServerSession(authOptions);
    const user = await getUser(session, domainData.domainObj._id);

    if (!user) {
      return Response.json({}, { status: 401 });
    }

    const { id } = body;

    if (!id) {
      return Response.json({ message: "Bad request" }, { status: 400 });
    }

    const invoice = await InvoiceModel.findOne({ invoiceId: id });

    if (!invoice) {
      return Response.json({ message: "Item not found" }, { status: 404 });
    }

    const membership = await MembershipModel.findOne({
      membershipId: invoice.membershipId,
    });

    if (!membership || membership.userId !== user.userId) {
      return Response.json({}, { status: 401 });
    }

    return Response.json({ status: invoice.status });
  } catch (err: any) {
    Log.error(`Error verifying invoice: ${err.message}`, {
      // domain: domainName,
      body,
      stack: err.stack,
    });
    return Response.json({ message: err.message }, { status: 500 });
  }
}
