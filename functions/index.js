const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp(functions.config().firebase);
var rate;
var exetended_rate;

var database = admin.database();

//  Database reference
const defaultRateRef = admin
  .database()
  .ref("/Entry_point/details/")
  .once("value", function (snapshot) {
    rate = snapshot.child("rate").val();
    exetended_rate = snapshot.child("exetended_rate").val();
  });

var debtors = admin.database().ref("/Entry_point/account_records/");

//schedule adjustment date update daily as follows
var date = new Date();
var day = date.getDate();
var month = date.getMonth() + 1;
var year = date.getFullYear();
var fulldate = day + "-" + month + "-" + year;

exports.updateAdjusmentDateDaily = functions.pubsub
  .schedule("0 22 * * *")
  .timeZone("Africa/Harare")
  .onRun(async () => {
    console.log("   starting  to update date adjustment");
    const updates = {};
    const snapshot = await database
      .ref("Entry_point/account_records/")
      .once("value");
    snapshot.forEach((childsnapshot) => {
      updates[
        "Entry_point/account_records/" + childsnapshot.key + "/adjustmentdate"
      ] = fulldate;
    });
    return database.ref().update(updates);
  });

//Listeningto changes on the adjustments date
exports.newUpdateDetected = functions.database
  .ref("Entry_point/account_records/{accountId}/adjustmentdate")
  .onUpdate((change, context) => {
    var olddatevar = change.before.val();
    var newadatevar = change.after.val();
    var accountId = context.params.accountId;

    //log changes to console
    console.log(
      "Account id is:    " +
        accountId +
        "   date changed from: " +
        olddatevar +
        " to:   " +
        newadatevar
    );

    debtors
      .child(accountId)
      .once("value")
      .then(function (snapshot) {
        var accountnumber = snapshot.child("accountnumber").val();
        var amountwing = snapshot.child("amountowing").val();
        var plusaccrual = snapshot.child("plusaccrual").val();
        var duedatevar = snapshot.child("duedate").val();
        var clientname = snapshot.child("accountname").val();

        //format dates to javascipt compatible format (ie mm-dd-yyyy)
        var oldatechunks = olddatevar.split("-");
        var newdatechunk = newadatevar.split("-");
        var duedatechunk = duedatevar.split("-");

        var oldformatedate =
          oldatechunks[1] + "-" + oldatechunks[0] + "-" + oldatechunks[2];
        var newformatedate =
          newdatechunk[1] + "-" + newdatechunk[0] + "-" + newdatechunk[2];
        var formattedduedate =
          duedatechunk[1] + "-" + duedatechunk[0] + "-" + duedatechunk[2];

        var olddate = new Date(oldformatedate);
        var newadate = new Date(newformatedate);
        var dudate = new Date(formattedduedate);
        const oneday = 24 * 60 * 60 * 1000;
        var differenceIndays = Math.round(
          Math.abs((olddate - newadate) / oneday)
        );

        //check if duedate has passed and account balance is not zero
        if (
          dudate <= newadate &&
          amountwing === plusaccrual &&
          amountwing > 0
        ) {
          var newamount = (rate / 100 + 1) * amountwing;

          database
            .ref("/Entry_point/account_records/" + accountId + "/amountowing")
            .set(newamount.toFixed(2) + "");

          //set values for Default penaltiesRef
          var disbursementModelObject = {
            accountnumber: accountnumber,
            branch: "",
            clientname: clientname,
            disbursementdate: newadatevar,
            duedate: duedatevar,
            loanamount: ((rate / 100) * amountwing).toFixed(2) + "",
            percentinterest: rate + "",
            principalplusinterest: newamount.toFixed(2) + "",
            processedby: "System automatic update",
            signature: "System automatic update",
            timestamp: differenceIndays + " days",
            uid: "some_UID",
          };
          database
            .ref("/Entry_point/penalties/" + newadatevar + "/" + accountId)
            .set(disbursementModelObject);
        }

        console.log("THE ACCOUNT IS: " + accountnumber);
      });
  });

//---------------------------Overdue penalties implimentation---------------

exports.updateOverduepenaltiesAdjustmentDate = functions.pubsub
  .schedule("15 0 * * *")
  .timeZone("Africa/Harare")
  //.schedule("every 3 minutes")
  .onRun(async () => {
    console.log("   starting  to update Overdue date adjustment");
    const overduadateupdates = {};
    const overduesnapshot = await database
      .ref("Entry_point/account_records/")
      .once("value");
    overduesnapshot.forEach((childsnapshot) => {
      overduadateupdates[
        "Entry_point/account_records/" +
          childsnapshot.key +
          "/interestadjustment"
      ] = fulldate;
    });
    return database.ref().update(overduadateupdates);
  });

//Listeningto changes on the date adjustments
exports.newOverDueDateUpdateDetected = functions.database
  .ref("Entry_point/account_records/{accountIdNode}/interestadjustment")
  .onUpdate((change, context) => {
    var oldadjustdatevar = change.before.val();
    var newadjustadatevar = change.after.val();
    var accountID = context.params.accountIdNode;
    console.log(
      "Account id is:    " +
        accountID +
        "   date changed from: " +
        oldadjustdatevar +
        " to:   " +
        newadjustadatevar
    );

    debtors
      .child(accountID)
      .once("value")
      .then(function (snapshot) {
        var debtoraccountnumber = snapshot.child("accountnumber").val();
        var debtoramountwing = snapshot.child("amountowing").val();
        var debtorplusaccrual = snapshot.child("plusaccrual").val();
        var debtorduedatevar = snapshot.child("duedate").val();
        var debtordisbursedatevar = snapshot.child("disbursementdate").val();
        var debtorclientname = snapshot.child("accountname").val();
        var debtorloantenure = snapshot.child("loantenure").val();

        //format dates to javascipt compatible format (ie mm-dd-yyyy)
        var oldatechunksadj = oldadjustdatevar.split("-");
        var newdatechunkadj = newadjustadatevar.split("-");
        var duedatechunkadj = debtorduedatevar.split("-");
        var disburedatechunkadj = debtordisbursedatevar.split("-");

        var oldformatedateadj =
          oldatechunksadj[1] +
          "-" +
          oldatechunksadj[0] +
          "-" +
          oldatechunksadj[2];
        var newformatedateadj =
          newdatechunkadj[1] +
          "-" +
          newdatechunkadj[0] +
          "-" +
          newdatechunkadj[2];
        var formattedduedateadj =
          duedatechunkadj[1] +
          "-" +
          duedatechunkadj[0] +
          "-" +
          duedatechunkadj[2];

        var formatteddisbursedateadj =
          disburedatechunkadj[1] +
          "-" +
          disburedatechunkadj[0] +
          "-" +
          disburedatechunkadj[2];

        //determine loan age
        var olddateadj = new Date(oldformatedateadj);
        var newadateadj = new Date(newformatedateadj);
        var dudateadj = new Date(formattedduedateadj);
        var disbursedateadj = new Date(formatteddisbursedateadj);
        const onedayadj = 24 * 60 * 60 * 1000;
        var daysSinceLastAdj = Math.round(
          Math.abs((olddateadj - newadateadj) / onedayadj)
        );
        var daysSinceOverdue = Math.round(
          Math.abs((newadateadj - dudateadj) / onedayadj)
        );
        var loanAge = Math.round((newadateadj - disbursedateadj) / onedayadj);

        //if account overdue , apply penalty rate and update amount owing
        if (
          dudateadj < newadateadj &&
          debtoramountwing > 0 &&
          daysSinceOverdue < 61 &&
          daysSinceLastAdj > 0 &&
          loanAge >= debtorloantenure
        ) {
          var newamountadj =
            (exetended_rate / 100 + 1) * debtoramountwing * daysSinceLastAdj;
          database
            .ref("/Entry_point/account_records/" + accountID + "/amountowing")
            .set(newamountadj.toFixed(2) + "");

          //set values for penaltiesRef
          var disbursementModelObjectadj = {
            accountnumber: debtoraccountnumber,
            branch: "",
            clientname: debtorclientname,
            disbursementdate: newadjustadatevar,
            duedate: debtorduedatevar,
            loanamount:
              (
                (exetended_rate / 100) *
                debtoramountwing *
                daysSinceLastAdj
              ).toFixed(2) + "",
            percentinterest: exetended_rate + "",
            principalplusinterest: newamountadj.toFixed(2) + "",
            processedby: "System automatic update",
            signature: "System automatic update",
            timestamp: daysSinceLastAdj + " days",
            uid: "System automatic update",
          };
          database
            .ref(
              "/Entry_point/overdue_dishes/" +
                newadjustadatevar +
                "/" +
                accountID
            )
            .set(disbursementModelObjectadj);
        }

        //  Log to console
        console.log(
          "THE ACCOUNT IS: " + accountID + " Loan age is: " + loanAge
        );
      });
  });
