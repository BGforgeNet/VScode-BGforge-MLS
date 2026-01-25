///////////////////////////////////////////////////////////////////////
// Ascension : BSAREV25 
///////////////////////////////////////////////////////////////////////
// weimer: this basically prevents sarevok from bantering with non-party
// members [DW: fixed in FP and EE, so omitted here] and 
// changes the weights so that his conversations with Player1
// come first. 
///////////////////////////////////////////////////////////////////////

SET_WEIGHT BSAREV25 83 #-4
SET_WEIGHT BSAREV25 105 #-3
SET_WEIGHT BSAREV25 120 #-2
SET_WEIGHT BSAREV25 142 #-1

///////////////////////////////////////////////////////////////////////
// DW addition: Sarevok has conditions to trigger his conversations, but
// those triggers aren't in the dialog file itself, which can result in
// them firing implausibly early. Add them.
///////////////////////////////////////////////////////////////////////

ADD_STATE_TRIGGER bsarev25 105 ~Dead("gromnir")~
ADD_STATE_TRIGGER bsarev25 120 ~GlobalGT("Enclave","GLOBAL",0)~