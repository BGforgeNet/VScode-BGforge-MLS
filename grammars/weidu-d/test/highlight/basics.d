/* block comment */
// <- comment
// line comment
// <- comment

BEGIN ~myfile~
// <- function.builtin
//    ^^^^^^^^ string

IF ~trigger~ THEN BEGIN mystate
// <- keyword
//           ^^^^ keyword
//                ^^^^^ keyword
//                      ^^^^^^^ label
  SAY ~Hello world~
//^^^ keyword
//    ^^^^^^^^^^^^^ string
  IF ~True()~ THEN REPLY ~Yes~ GOTO next
//^^ keyword
//            ^^^^ keyword
//                 ^^^^^ keyword
//                       ^^^^^ string
//                             ^^^^ keyword
  + ~Maybe~ + ~Perhaps~ EXTERN ~otherfile~ other_state
//^ operator
//                      ^^^^^^ keyword
END
// <- keyword

APPEND ~myfile~
// <- function.builtin
  IF ~~ THEN BEGIN state2
    SAY @123
//      ^^^^ string.special
  END
END

CHAIN IF ~True()~ THEN ~myfile~ mystate
// <- function.builtin
//    ^^ keyword
//                ^^^^ keyword
  ~First line~
  == ~otherfile~ ~Second line~
END ~myfile~ done
// <- keyword
